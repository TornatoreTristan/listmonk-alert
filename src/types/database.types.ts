export interface CampaignView {
  id: number;
  campaign_id: number;
  subscriber_id: number;
  created_at: Date;
}

export interface Subscriber {
  id: number;
  email: string;
  name: string;
}

export interface Campaign {
  id: number;
  name: string;
  subject: string;
}

export interface EnrichedCampaignView {
  id: number;
  campaign_id: number;
  subscriber_id: number;
  created_at: Date;
  subscriber_email: string;
  subscriber_name: string;
  campaign_name: string;
  campaign_subject: string;
}
