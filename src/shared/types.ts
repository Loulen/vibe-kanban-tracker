/**
 * Shared types for the vibe-kanban tracker extension
 */

import type { ParsedRoute } from '../content/url-parser';

// Message types sent from content script to background script
export type MessageType =
  | 'ACTIVITY'
  | 'SCROLL'
  | 'FOCUS'
  | 'BLUR'
  | 'NAVIGATION'
  | 'HUMAN_INTERVENTION'
  | 'TYPING'
  | 'MESSAGE_SENT';

// Base message interface
export interface BaseMessage {
  type: MessageType;
  payload: {
    route: ParsedRoute;
    timestamp: number;
  };
}

// Activity message (mouse/keyboard)
export interface ActivityMessage extends BaseMessage {
  type: 'ACTIVITY';
  payload: BaseMessage['payload'] & {
    activityType: 'mouse' | 'keyboard';
  };
}

// Scroll message
export interface ScrollMessage extends BaseMessage {
  type: 'SCROLL';
  payload: BaseMessage['payload'] & {
    scrollPosition: number;
    scrollPercentage: number;
  };
}

// Focus message
export interface FocusMessage extends BaseMessage {
  type: 'FOCUS';
}

// Blur message
export interface BlurMessage extends BaseMessage {
  type: 'BLUR';
}

// Navigation message (SPA route change)
export interface NavigationMessage extends BaseMessage {
  type: 'NAVIGATION';
  payload: BaseMessage['payload'] & {
    previousRoute?: ParsedRoute;
  };
}

// Human intervention message (user sending message to Claude)
export interface HumanInterventionMessage extends BaseMessage {
  type: 'HUMAN_INTERVENTION';
  payload: BaseMessage['payload'] & {
    triggerType: 'keyboard_shortcut' | 'button_click';
    buttonText?: string;
  };
}

// Typing message (character count updates)
export interface TypingMessage extends BaseMessage {
  type: 'TYPING';
  payload: BaseMessage['payload'] & {
    characterCount: number;
  };
}

// Message sent (captures message length on submission)
export interface MessageSentMessage extends BaseMessage {
  type: 'MESSAGE_SENT';
  payload: BaseMessage['payload'] & {
    messageLength: number;
    triggerType: 'keyboard_shortcut' | 'button_click';
  };
}

// Union type of all message types
export type ContentMessage =
  | ActivityMessage
  | ScrollMessage
  | FocusMessage
  | BlurMessage
  | NavigationMessage
  | HumanInterventionMessage
  | TypingMessage
  | MessageSentMessage;

// Re-export ParsedRoute for convenience
export type { ParsedRoute } from '../content/url-parser';
