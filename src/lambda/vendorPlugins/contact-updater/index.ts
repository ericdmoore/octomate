/**
 * Contact Updater Lambda
 * 
 * This Lambda function is responsible for updating contact information for various people tha
 * 
 * Some concepts to keep in consideration:
 * 
 * Conservative Merging
 * - YourOwn Contact is more Updatable from things you say - moreso than trusted contacts
 * 
 * 
 * Dont glean from untrusted sources.
 * Threads are trusted if they are sent by the user or if they are direct threads.
 * 
 * - trusted sources (sent mail + direct threads)
 * - conservative merging (review required)
 * - outputting .vcf instead of directly editing a contact book
 * 
 * 
 
 * Keep Records in an "OctoMate Contact Book"
 * - This is a separate contact book that is used to store the contacts that are updated by the Contact Updater.
 * - Automatically stage updates for approval to the contact book with the latest information from trusted senders
 * - Contact Book can export as VCard - or send to an external API source OnApproval
 * 
 * Look for:
 * - Birthdays
 * - Anniversaries
 * - Addresses
 * - Phone Numbers
 * - Emails
 * - Family & Friend Graphs
 * - Social Media Links/Profiles 
 * - Work Place Name/Address/Phone/Email
 * 
 * 
 * Sources of Truth - Side Effect Merge
 * - Personal Contacts
 * - Google Contacts API
 * - Microsoft Graph / Outlook People API
 
 * 
 * ENTERPRISE Options
 * - Salesforce API
 * - HubSpot CRM API
 * - Zoho CRM API
 * - Pipedrive / Close / Freshsales APIs
 *
 */