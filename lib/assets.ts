// Bare common crypto tickers are reserved for crypto, never equity aliases.
export const cryptoAssets: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', XRP: 'XRP', SOL: 'Solana',
  DOGE: 'Dogecoin', ADA: 'Cardano', LTC: 'Litecoin', BCH: 'Bitcoin Cash',
  AVAX: 'Avalanche', LINK: 'Chainlink', DOT: 'Polkadot',
};
export function isCryptoSymbol(symbol: string) {
  return Object.hasOwn(cryptoAssets, symbol.toUpperCase()) || /-(USD|USDT|USDC)$/.test(symbol.toUpperCase());
}
export function cryptoProduct(symbol: string) {
  const base = symbol.toUpperCase().replace(/-USD$/, '');
  if (!Object.hasOwn(cryptoAssets, base)) throw Error('暂不支持此数字货币交易对，请使用 BTC、ETH、XRP 或对应 -USD 代码。');
  return `${base}-USD`;
}
