import { FeeTier } from "./FeeTier";

export type BlendPoolMarkers = {
  poolAddress: string;
  token0Address: string;
  token1Address: string;
  silo0Address: string;
  silo1Address: string;
  feeTier: FeeTier;
};
