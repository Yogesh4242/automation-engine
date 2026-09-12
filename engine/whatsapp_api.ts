export interface WhatsAppCampaignPayload {
    customerId: string;
    phoneNumber: string;
    messageText: string;
    mediaUrl?: string;
    campaignCategory: string;
    // campaignCategory: AutomationCategory;
    restaurantId: string;
}