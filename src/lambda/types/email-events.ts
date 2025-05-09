// types/email-events.ts

// Base structure for all email-related events sent via EventBridge
export interface BaseEmailEvent {
    messageId: string
    from: string
    to: string
    subject?: string
    body: {
      text?:string
      markup:[{
        lang: 'XML' | 'HTML' | 'XHTML' | 'MD' | string
        body?: string
      }]
    }
    attachments:[{
        enc:string
        content: Uint8Array
    }]
    timestamp: {
        iso: string
        epochSec: number 
    }
  }
  
  export interface EmailReceivedEvent extends BaseEmailEvent {
    eventType: 'EmailReceived';
    rawS3Url: string;
    metadata: Record<string, any>; // could be typed further later
  }
  
  export interface EmailSentEvent extends BaseEmailEvent {
    eventType: 'EmailSent';
  }
  
  export interface PluginExecutionStartEvent {
    eventType: 'PluginExecutionStart';
    pluginName: string;
    triggerEvent: string;
    startedAt: string;
    
  }
  
  export interface PluginExecutionSuccessEvent {
    eventType: 'PluginExecutionSuccess';
    pluginName: string;
    triggerEvent: string;
    durationMs: number;
    endedAt: string;
  }
  
  export interface PluginExecutionFailureEvent {
    eventType: 'PluginExecutionFailure';
    pluginName: string;
    triggerEvent: string;
    errorMessage: string;
    errorStack?: string; 
  }
  
  export type EmailSystemEvent =
    | EmailReceivedEvent
    | EmailSentEvent
    | PluginExecutionStartEvent
    | PluginExecutionSuccessEvent
    | PluginExecutionFailureEvent;
  