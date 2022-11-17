export type PriceRelayLatestResponse = {
  [key: string]: {
    price: number;
  };
};

export type PriceRelayHistoricalResponse = {
  [key: string]: {
    prices: {
      price: number;
      timestamp: number;
    }[];
  };
};

export type PriceRelayConsolidatedResponse = {
  latest: PriceRelayLatestResponse;
  historical: PriceRelayHistoricalResponse;
};
