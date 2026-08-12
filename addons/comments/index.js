// Comments Addon - Main Exports
//
// Usage (in site components):
//   import Comments from '@addons/comments/Comments';
//
//   <Comments
//     databaseClass="comments"
//     relId={post.id}
//     relType="post"
//     options={{
//       maxDepth: 2,
//       enableVoting: false,
//       sortOrder: 'newest'
//     }}
//   />
//
// Usage (in framework code):
//   import Comments from '@/addons/comments';
//   import { Comments, CommentForm } from '@/addons/comments';

export { default } from './components/Comments';
export { default as Comments } from './components/Comments';
export { default as CommentForm } from './components/CommentForm';
export { default as CommentList } from './components/CommentList';
export { default as CommentThread } from './components/CommentThread';
export { default as CommentItem } from './components/CommentItem';
