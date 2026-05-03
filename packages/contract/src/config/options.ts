type ControllerClass = new (...args: never[]) => object;

export type GenerateClientOptions = {
  readonly controllers: readonly ControllerClass[];
  readonly dist: string;
  readonly watch?: boolean;
};

// identity 関数。defineConfig 経由で書くと TS が `controllers` の literal narrow を維持しやすい。
export const defineConfig = <T extends GenerateClientOptions>(config: T): T => config;
