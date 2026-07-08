import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import sharp from 'sharp'
import ffmpegStatic from 'ffmpeg-static'

function getFileExtension(name: string, fallback = 'bin') {
  return (name.split('.').pop() || fallback).toLowerCase()
}

function buildStoragePath(userId: string, kind: 'image' | 'video', extension: string) {
  const timestamp = Date.now()
  return `${userId}/${kind}/${timestamp}.${extension}`
}

async function uploadToStorage(supabase: any, bucket: string, storagePath: string, buffer: Buffer, contentType: string) {
  const { error } = await supabase.storage.from(bucket).upload(storagePath, new Blob([buffer], { type: contentType }), {
    contentType,
    upsert: true,
  })

  if (error) throw error

  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(storagePath)
  return publicData?.publicUrl ?? null
}

async function processImageBuffer(buffer: Buffer, contentType: string) {
  const image = sharp(buffer)
  const metadata = await image.metadata()
  const targetWidth = metadata.width && metadata.width > 1600 ? 1600 : metadata.width || 1200

  const mainBuffer = await image
    .resize({ width: targetWidth, withoutEnlargement: true, fit: 'inside' })
    .jpeg({ quality: 82, progressive: true })
    .toBuffer()

  const thumbBuffer = await sharp(buffer)
    .resize({ width: 480, withoutEnlargement: true, fit: 'inside' })
    .jpeg({ quality: 72, progressive: true })
    .toBuffer()

  return {
    mainBuffer,
    thumbBuffer,
    contentType: contentType.includes('png') ? 'image/png' : 'image/jpeg',
  }
}

async function processVideoBuffer(buffer: Buffer, fileName: string) {
  const ffmpegBinary = ffmpegStatic || 'ffmpeg'
  if (!ffmpegStatic) {
    return { buffer, contentType: 'video/mp4' }
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zivona-'))
  const inputPath = path.join(tempDir, `input-${Date.now()}-${path.basename(fileName)}`)
  const outputPath = path.join(tempDir, `output-${Date.now()}.mp4`)

  await fs.writeFile(inputPath, buffer)

  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn(ffmpegBinary, [
      '-y',
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '26',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputPath,
    ]) as any

    ffmpeg.on('error', reject)
    ffmpeg.on('close', (code: number) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited with code ${code}`))
    })
  })

  const outputBuffer = await fs.readFile(outputPath)
  await fs.rm(tempDir, { recursive: true, force: true })

  return {
    buffer: outputBuffer,
    contentType: 'video/mp4',
  }
}

export async function processUploadMedia(file: File, userId: string, supabase: any) {
  const mime = file.type || 'application/octet-stream'
  const extension = getFileExtension(file.name)
  const isVideo = mime.startsWith('video/') || ['mp4', 'mov', 'webm', 'mkv'].includes(extension)

  if (isVideo) {
    const arrayBuffer = await file.arrayBuffer()
    const processed = await processVideoBuffer(Buffer.from(arrayBuffer), file.name)
    const storagePath = buildStoragePath(userId, 'video', 'mp4')
    const url = await uploadToStorage(supabase, 'zivona-uploads', storagePath, processed.buffer, processed.contentType)

    return {
      url,
      kind: 'video' as const,
      mimeType: processed.contentType,
      extension: 'mp4',
    }
  }

  const arrayBuffer = await file.arrayBuffer()
  const processed = await processImageBuffer(Buffer.from(arrayBuffer), mime)
  const storagePath = buildStoragePath(userId, 'image', 'jpg')
  const thumbnailPath = buildStoragePath(userId, 'image', 'thumb.jpg')

  const url = await uploadToStorage(supabase, 'zivona-uploads', storagePath, processed.mainBuffer, processed.contentType)
  const thumbnailUrl = await uploadToStorage(supabase, 'zivona-uploads', thumbnailPath, processed.thumbBuffer, 'image/jpeg')

  return {
    url,
    thumbnailUrl,
    kind: 'image' as const,
    mimeType: processed.contentType,
    extension: 'jpg',
  }
}
