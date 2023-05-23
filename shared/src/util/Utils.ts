export function isDevelopment() {
  return process.env.NODE_ENV === 'development';
}

export function isProduction() {
  return process.env.NODE_ENV === 'production';
}

export function isDappnet() {
  const url = window?.location?.href || '';
  return (
    process.env.REACT_APP_DEV_DAPPNET === 'true' ||
    ['https://aloe.eth/', 'https://earn.aloe.eth/', 'https://prime.aloe.eth/'].some((v) => url.startsWith(v))
  );
}
