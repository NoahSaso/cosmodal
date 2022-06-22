// Causes SSR issues if importing this package directly... idk why
export const getKeplrFromWindow = async () =>
  (await import("@keplr-wallet/stores")).getKeplrFromWindow()
