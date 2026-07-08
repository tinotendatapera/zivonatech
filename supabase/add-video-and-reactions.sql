-- Add video support to posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'posts'
      AND column_name = 'video_url'
  ) THEN
    ALTER TABLE public.posts ADD COLUMN video_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'posts'
      AND column_name = 'post_type'
  ) THEN
    ALTER TABLE public.posts ADD COLUMN post_type text DEFAULT 'text' CHECK (post_type IN ('text', 'image', 'video', 'poll'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'posts'
      AND column_name = 'shares_count'
  ) THEN
    ALTER TABLE public.posts ADD COLUMN shares_count integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'posts'
      AND column_name = 'reposts_count'
  ) THEN
    ALTER TABLE public.posts ADD COLUMN reposts_count integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'posts'
      AND column_name = 'is_repost'
  ) THEN
    ALTER TABLE public.posts ADD COLUMN is_repost boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'posts'
      AND column_name = 'repost_of_id'
  ) THEN
    ALTER TABLE public.posts ADD COLUMN repost_of_id uuid REFERENCES public.posts(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add reactions support
CREATE TABLE IF NOT EXISTS public.reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  reaction_type text NOT NULL DEFAULT 'like' CHECK (reaction_type IN ('like', 'love', 'haha', 'wow', 'sad', 'angry')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT has_target CHECK ((post_id IS NOT NULL) OR (comment_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS reactions_user_post_type_idx ON public.reactions(user_id, post_id, reaction_type) WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS reactions_user_comment_type_idx ON public.reactions(user_id, comment_id, reaction_type) WHERE comment_id IS NOT NULL;

-- Add polls support
CREATE TABLE IF NOT EXISTS public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  question text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  text text NOT NULL,
  vote_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS polls_post_id_idx ON public.polls(post_id);
CREATE INDEX IF NOT EXISTS poll_options_poll_id_idx ON public.poll_options(poll_id);
CREATE INDEX IF NOT EXISTS poll_votes_poll_id_idx ON public.poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS poll_votes_user_id_idx ON public.poll_votes(user_id);
