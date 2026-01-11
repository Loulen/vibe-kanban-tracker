/**
 * Type declarations for CSS file imports
 * Allows importing CSS files as strings for Shadow DOM injection
 */

declare module '*.css' {
  const content: string;
  export default content;
}
