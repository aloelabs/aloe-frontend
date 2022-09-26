import { useEffect } from "react";

export default function useEffectOnce(func: () => void) {
  useEffect(func, []);
}
