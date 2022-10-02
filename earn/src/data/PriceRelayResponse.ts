export type PriceRelayResponse = {
  data: {
    [key: string]: {
      id: number;
      name: string;
      symbol: string;
      platform?: {
        id: number;
        name: string;
        symbol: string;
        slug: string;
        token_address: string;
      }
      quote: {
        [key: string]: {
          price: number;
        };
      };
    };
  };
};
