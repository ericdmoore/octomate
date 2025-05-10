import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { UnRequire } from '../../lib/events/util-types'

/**
 * 
 * Email Event Lifecycle
 * =============================
 * 
 * 
 * INBOUND EMAIL EVENTS
 * ----------------------
 * 
 * 1. SNS:`emailReceived`
 *    before hand: SES-> SNS -> EvB
 * 
 * 2. `emailTaggedPluginManifest`
 *    checks the mode and policies set for the mail-user
 *    vacation mode = auto-responder: ON
 *    SPAM mode: ALWAYS ON
 *    SPAM mode: ALWAYS ON
 *    Auto-Forwarding: matching a given search query
 * 
 * 3. `emailProcessingStart`
 *    the email is tagged with a manifest of plugins to run
 *    the plugins all run asynchronously, processing the email
 *       Plugin Examples:
 *        - Spam Detection: powered by ________
 *        - Prioritization: powered by ________
 *        - Summarization: powered by ________
 *        - Auto-Tagging: powered by ________
 *        - Auto-Classification: powered by ________
 *        - Auto-Foldering: powered by ________
 *        - ICS Generation: powered by ________
 *        - VCard Generation: powered by ________
 *        - Automatic Contact Creation: powered by ________
 *        - Automatic Contact Update Suggestions: powered by ________
 *        - Auto-Responder 
 *        - Auto-Forwarding
 *        - Auto-Archiving
 *        - Auto-Deletion (TTL)
 *        - Email2Rss: SideEffect Storage for API availability
 *        - Email2Rss: SideEffect Storage for API availability
 * 
 * 3b. `plugin/<name>/start`
 * 3c. `plugin/<name>/stop`
 * 
 * 4. `emailProcessingStop`
 *    The manifest has been filled in by each plugin
 *    Each plugin checks to see if it is the last to finish
 *    If it is the last to finish, it emits `emailProcessingStop` 
 * 
 * 
 * 8. `emailStateChanged`
 * 
 *    MetaData Mutations
 *          - Read/Unread
 *          - Starred/Unstarred
 *          - TagAdded/TagRemoved
 *          - TagAdded/TagRemoved
 *          - MovedToFolder  
 *
 * 
 * GENERALIZED EVENTS
 * --------------------
 * 
 * - `emailStored`
 * 
 *    After the processing has been finisihed, the email is stored
 *      Raw Data => S3
 *      Metadata => DynamoDB
 * 
 * - `emailIndexed`
 *    After raw copies are stored - we can index it into OpenSearch 
 *      conisder batching this operation for a budget opimization
 *      "EventBridge Archive and Scheduling" might be helpful in executing this optimization
 *      Raw Data => Open Search Serverless (pay by OCU usage)
 * 
 * - `emailAvailable`
 *    Technically, the email is available to the user once its stored
 *    but we can emit this event to notify the user that the email is available in search too
 * 
 *    we can usually tolerate the delay in search criteria 
 *    - since the last 5 minutes should be at the top of the inbox
 * 
 * - `emailDeleted`
 *   The email needs to be deleted from all parts of the system
 *   from the search index, metadata, and raw datastore
 * 
 * - `scheduled-vacuum`
 *   Ensure all TTL emails are removed from the whole system
 *   Perform necessary "compaction" operations on data-stores
 *   Process/Clear Queue-ToBe-Indexed`
 * 
 * 
 * OUTBOUND EMAIL LIFECYCLE
 * ----------------------------------
 * 
 * 1. `emailDraftStarted`
 * 
 * 2. `emailDraftSaved`
 * 
 * 3. `emailDraftProcessingStart`
 * 
 * 4. `emailDraftProcessingStop`
 * 
 * 5. `emailDraftGenerated`
 * 
 * 6. `emailDraftGenerationsApproved`
 * 
 * #See Above Events
 * 7. `emailStored`  /8. `emailIndexed` /9. `emailAvailable`
 * 
 * 10. `emailSent`
 * 
 */

//#region interfaces

export type PluginStateCommon<State = 'string'> = {
    pluginName: string;
    emailId: string;
    timestamp: number; // epochSec
    status: State;
}

export interface PluginStartData extends PluginStateCommon<'Start'> {
    // config is for Mode-Level-Config
    config?: Record<string, any>;
    // Data Source Config will be stamped on the email in the `MetaDataDB`
}

export interface PluginFailedData extends PluginStateCommon<'Failed'> {
    reason?: string
    errorMessages?: string[];
}


export interface PluginFinishedData extends PluginStateCommon<'Finished'> {
    result?: string
    warning?: string;
    outputSummary?: string;
}

export interface EmailStateCommmon {
    timestamp: number;  // epochSec
    emailId: string;
    to: string[];
    from: string;
    rawS3Url: string;
}

export interface EmailReceivedData extends EmailStateCommmon {}

export interface EmailTaggedPluginManifestData extends EmailStateCommmon {
    pluginManifest: string[];
}

export interface EmailProcessingStartData extends EmailStateCommmon {
    pluginManifestWithConfig: Record<string, unknown>;
}

export interface EmailProcessingStopData extends EmailStateCommmon {
    completedPlugins: string[];
    durationMs?: number;
}

export interface EmailProcessingFinishedData {
    // 100% Finish
    // Less Than 100% Finish; a few fails
    // 100% Stopped
    status: 'complete' | 'partial' | 'failed';
    completedPlugins: string[];
    erroredPlugins: string[];
}

export interface EmailStateChangedData {
    emailId: string;
    changed: Array<{
      key: 'read' | 'starred' | 'tag-added' | 'tag-removed' | 'folder-moved' | string
      value: string;
    }>;
}

export interface EmailDeletedData {
    emailId: string;
    deletedBy: string;
    reason?: string;
}

export interface EmailScheduledVacuum {
    jobId: string;
    timestamp: string;
}

export interface EmailStoredData {
    emailId: string;
    s3Url: string;
    metadataKey: string;
    storedAt: string;
}
  
export interface EmailIndexedData {
    emailId: string;
    indexId: string;
    timestamp: string;
    indexType: 'fulltext' | 'metadata';
}
  
export interface EmailAvailableData {
    emailId: string;
    visibleInSearchAt: string;
}

export interface EmailDraftStartedData {
    draftId: string;
    createdBy: string;
    timestamp: string;
}
  
export interface EmailDraftSavedData {
    draftId: string;
    lastSavedAt: string;
    contentSummary: string;
}
  
export interface EmailDraftProcessingStartData {
    draftId: string;
    pluginManifest: string[];
}
  
  export interface EmailDraftProcessingStopData {
    draftId: string;
    completedPlugins: string[];
  }
  
export interface EmailDraftGeneratedData {
    draftId: string;
    contentHtml: string;
    attachments?: string[];
}
  
export interface EmailDraftGenerationsApprovedData {
    draftId: string;
    approvedBy: string;
    approvedAt: string;
}
  
export interface EmailSentData {
    emailId: string;
    to: string[];
    from: string;
    subject: string;
    sentAt: string;
    messageId: string;
}


export type EmailEventPayload = 
| EmailReceivedData
| EmailTaggedPluginManifestData
| EmailProcessingStartData
| EmailProcessingStopData
| EmailProcessingFinishedData
| EmailStateChangedData
| EmailDeletedData
| EmailScheduledVacuum
| EmailStoredData
| EmailIndexedData
| EmailAvailableData
| EmailDraftStartedData
| EmailDraftSavedData
| EmailDraftProcessingStartData
| EmailDraftProcessingStopData
| EmailDraftGeneratedData
| EmailDraftGenerationsApprovedData
| EmailSentData





//#endregion interfaces



export const octomateEventBridge = (i: {region: string, creds:{key: string, secret:string}})=>{
    const evb = new EventBridgeClient({
        region:i.region, credentials: { accessKeyId: i.creds.key, secretAccessKey: i.creds.secret}
    });

    const pluginStartData = (data:UnRequire<'timestamp', PluginStartData>)=>{
        const dataS = JSON.stringify({
            timestamp: Math.floor(Date.now() / 1000),
            ...data})
        if(dataS.length < 256_000, "PluginStartData is too long") throw new Error("PluginStartData is too long")
        
        return {
            Source: `octomate.plugin.${data.pluginName}`,
            DetailType: `plugin/${data.pluginName}/start`,
            Detail: dataS
        }
    }
    const pluginStopData = (data:UnRequire<'timestamp',PluginFailedData>)=>{

        const dataS = JSON.stringify({
            timestamp: Math.floor(Date.now() / 1000),
            ...data})
        if(dataS.length < 256_000, "PluginStartData is too long") throw new Error("PluginStartData is too long")
        
        return {
            Source: `octomate.plugin.${data.pluginName}`,
            DetailType: `plugin/${data.pluginName}/stop`,
            Detail: dataS
        }
    }
    const pluginFinishedData = (data:UnRequire<'timestamp', PluginFinishedData>)=>{

        const dataS = JSON.stringify(data)
        if(dataS.length < 256_000, "PluginStartData is too long") throw new Error("PluginStartData is too long")
            
        return {
            Source: `octomate.plugin.${data.pluginName}`,
            DetailType: `plugin/${data.pluginName}/stop`,
            Detail: dataS
        }
    }
    const pluginStart = async (data:UnRequire<'timestamp',PluginStartData>)=>{
        return evb.send(new PutEventsCommand({
            Entries: [pluginStartData({
                timestamp: Math.floor(Date.now() / 1000),
                ...data
            })],
        }));
    }
    const pluginStop =  async (data:UnRequire<'timestamp',PluginFailedData>)=>{
        return evb.send(new PutEventsCommand({
            Entries: [pluginStopData({
                timestamp: Math.floor(Date.now() / 1000),
                ...data
            })],
        }));
    }
    const pluginFinished =  async (data: UnRequire<'timestamp',PluginFinishedData>)=>{
        return evb.send(new PutEventsCommand({
            Entries: [pluginFinishedData({
                timestamp: Math.floor(Date.now() / 1000), 
                ...data
            })],
        }));
    }
    
    const plugins = {
        start: pluginStart, 
        stop: pluginStop, 
        finish: pluginFinished,
        startData: pluginStartData, 
        stopData: pluginStopData,
        finishData: pluginFinishedData
    };
    
    const inbound = {
            emailReceived: async (data:UnRequire<'timestamp',EmailReceivedData>)=>{
                return evb.send(new PutEventsCommand({
                    Entries: [{
                            Source: 'octomate.inbound.email',
                            DetailType: 'emailReceived',
                            Detail: JSON.stringify({
                                timestamp: Math.floor(Date.now() / 1000),
                                ...data
                            }),
                    }],
                }));
            },
            // data includes manifest
            emailTaggedPluginManifest: async (data:UnRequire<'timestamp',EmailTaggedPluginManifestData>)=>{
                const params = {
                    Entries: [{
                            Source: 'octomate.inbound.email',
                            DetailType: 'emailTaggedPluginManifest',
                            Detail: JSON.stringify({
                                timestamp: Math.floor(Date.now() / 1000),
                                ...data
                            }),
                    }],
                };
                return evb.send(new PutEventsCommand(params));
            },
            // include events for plugins
            emailProcessingStart: async (data:UnRequire<'timestamp',EmailProcessingStartData>, pluginList: UnRequire<'timestamp',PluginStartData>[] )=>{        
                
                if(pluginList.length > 10) throw new Error("PluginList is too long")
                // OR we should use a generator and call the Send function multiple timess
        
                const params = {
                    Entries: [{
                        Source: 'octomate.inbound.email',
                        DetailType: 'emailProcessingStart',
                        Detail: JSON.stringify({
                            timestamp: Math.floor(Date.now() / 1000),
                            ...data
                        }),
                    },
                    {   
                        // future event - wake up in 2 minutes to make sure its all done
                        DetailType: 'plugin/checkStatus',
                        Detail: JSON.stringify({ emailId: data.emailId }),
                        EventTime: new Date(Date.now() + 2 * 60 * 1000) // 2 minutes from now
                    },
                    ...pluginList.map(plugins.startData)
                ]};
                return evb.send(new PutEventsCommand(params));
            },
            emailProcessingFinished: async (data:EmailProcessingFinishedData)=>{
                const params = {
                    Entries: [{
                            Source: 'octomate.inbound.email',
                            DetailType: 'emailProcessingFinished',
                            Detail: JSON.stringify(data),
                    }],
                };
                return evb.send(new PutEventsCommand(params));
            },
            emailProcessingStop: async (data:EmailProcessingStopData)=>{
                const params = {
                    Entries: [{
                            Source: 'octomate.inbound.email',
                            DetailType: 'emailProcessingStop',
                            Detail: JSON.stringify(data),
                    }],
                };
                return evb.send(new PutEventsCommand(params));
            },
            emailStateChanged: async (data:EmailStateChangedData)=>{
                const params = {
                    Entries: [{
                            Source: 'octomate.inbound.email',
                            DetailType: 'emailStateChanged',
                            Detail: JSON.stringify(data),
                    }],
                };
                return evb.send(new PutEventsCommand(params));
            },
            emailDeleted: async (data:EmailDeletedData)=>{
                const params = {
                    Entries: [{
                            Source: 'octomate.inbound.email',
                            DetailType: 'emailDeleted',
                            Detail: JSON.stringify(data),
                    }],
                };
                return evb.send(new PutEventsCommand(params));
            },
            emailScheduledVacuum: async (data:EmailScheduledVacuum)=>{
                const params = {
                    Entries: [{
                            Source: 'octomate.inbound.email',
                            DetailType: 'emailScheduledVacuum',
                            Detail: JSON.stringify(data),
                    }],
                };
                return evb.send(new PutEventsCommand(params));
            },
        }
        const general = {
            // Standard Flow: S => I => A 
            emailStored: async (data:EmailStoredData) => {
                const params = {
                    Entries: [{
                            Source: 'octomate.general.email',
                            DetailType: 'emailStored',
                            Detail: JSON.stringify(data),
                    }],
                };
                return evb.send(new PutEventsCommand(params));
            },
            emailIndexed: async (data:EmailIndexedData)=>{
                const params = {
                    Entries: [{
                            Source: 'octomate.general.email',
                            DetailType: 'emailIndexed',
                            Detail: JSON.stringify(data),
                    }],
                };
                return evb.send(new PutEventsCommand(params));
            },
            emailAvailable: async (data:EmailAvailableData)=>{
                const params = {
                    Entries: [{
                            Source: 'octomate.inbound.email',
                            DetailType: 'emailAvailable',
                            Detail: JSON.stringify(data),
                    }],
                };
                return evb.send(new PutEventsCommand(params));
            },
        }
        const outbound = {
            emailDraftStarted: async (data:EmailDraftStartedData)=>{
                const params = {
                    Entries: [{
                            Source: 'octomate.outbound.email',
                            DetailType: 'emailDraftStarted',
                            Detail: JSON.stringify(data),
                    }],
                };
                return evb.send(new PutEventsCommand(params));
            },
            emailDraftSaved: async (data:EmailDraftSavedData)=>{
                const params = {
                    Entries: [{
                        Source: 'octomate.outbound.email',
                        DetailType: 'emailDraftSaved',
                        Detail: JSON.stringify(data),
                    }]
                }
                return evb.send(new PutEventsCommand(params));
            },
            // should we just move this to be in the general section?
            emailTaggedPluginManifest: async (data:EmailTaggedPluginManifestData)=>{
                const params = {
                    Entries: [{
                            Source: 'octomate.outbound.email',
                            DetailType: 'emailTaggedPluginManifest',
                            Detail: JSON.stringify(data),
                    }],
                };
                return evb.send(new PutEventsCommand(params));
            },
            emailDraftProcessingStart: async ( data:EmailDraftProcessingStartData, pluginList: PluginStartData[])=>{
                const params = {
                    Entries: [{
                            Source: 'octomate.outbound.email',
                            DetailType: 'emailDraftProcessingStart',
                            Detail: JSON.stringify(data),
                    }],
                    ...pluginList.map(plugins.startData)
                };
                return evb.send(new PutEventsCommand(params));
            },
            emailDraftProcessingStop: async (data:EmailDraftProcessingStopData)=>{
                const params = {
                    Entries: [{
                            Source: 'octomate.outbound.email',
                            DetailType: 'emailDraftProcessingStop',
                            Detail: JSON.stringify(data),
                    }],
                };
                return evb.send(new PutEventsCommand(params));
            },
            emailDraftGenerated: async (data:EmailDraftGeneratedData)=>{
                const params = {
                    Entries: [{
                            Source: 'octomate.outbound.email',
                            DetailType: 'emailDraftGenerated',
                            Detail: JSON.stringify(data),
                    }],
                };
                return evb.send(new PutEventsCommand(params));
            },
            emailDraftGenerationsApproved: async (data:EmailDraftGenerationsApprovedData) => {
                const params = {
                    Entries: [{
                            Source: 'octomate.outbound.email',
                            DetailType: 'emailDraftGenerationsApproved',
                            Detail: JSON.stringify(data),
                    }],
                };
                return evb.send(new PutEventsCommand(params));
            },
            emailSent: async (data:EmailSentData)=>{
                const params = {
                    Entries: [{
                            Source: 'octomate.outbound.email',
                            DetailType: 'emailSent',
                            Detail: JSON.stringify(data),
                    }],
                };
                return evb.send(new PutEventsCommand(params))
            }
        }
    return { general, inbound, outbound, plugins };
}

export default octomateEventBridge