export interface PostFrontmatter {
  title: string;
  date: string;
  description: string;
  tags: string[];
  category: string;
  published: boolean;
  image?: string;
}

export interface Post extends PostFrontmatter {
  slug: string;
  readingTime: string;
  content: string;
}

export type PostMeta = Omit<Post, "content"> & {
  excerpt?: string;
  viewCount?: number;
  likeCount?: number;
};
