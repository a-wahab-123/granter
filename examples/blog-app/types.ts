// Application types
export type User = {
  id: string;
  role: 'admin' | 'moderator' | 'user' | 'guest';
  email: string;
  isVerified: boolean;
  isBanned: boolean;
};

export type Post = {
  id: string;
  authorId: string;
  title: string;
  content: string;
  published: boolean;
  locked: boolean;
};

export type Comment = {
  id: string;
  authorId: string;
  postId: string;
  content: string;
};

// Application context
export type AppContext = {
  user: User | null;
  db: any; // Your database instance
};
