import React from 'react';
import { FeeTier, PrintFeeTier } from '../../data/FeeTier';
import RoundedBadge from 'shared/lib/components/common/RoundedBadge';

export type FeeTierProps = {
  feeTier: FeeTier;
  className?: string;
};

export default function FeeTierContainer(props: FeeTierProps) {
  const { feeTier, className } = props;
  return <RoundedBadge className={className}>Uniswap Fee Tier - {PrintFeeTier(feeTier)}</RoundedBadge>;
}
