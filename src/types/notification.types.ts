export interface GoogleChatMessage {
  cardsV2: GoogleChatCard[];
}

export interface GoogleChatCard {
  card: {
    header: {
      title: string;
      subtitle: string;
    };
    sections: GoogleChatSection[];
  };
}

export interface GoogleChatSection {
  widgets: GoogleChatWidget[];
}

export interface GoogleChatWidget {
  decoratedText: {
    topLabel: string;
    text: string;
  };
}

export interface NotificationData {
  subscriberName: string;
  subscriberEmail: string;
  campaignName: string;
  campaignSubject: string;
  openedAt: Date;
}
