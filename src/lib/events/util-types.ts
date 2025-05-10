export type UnRequire<K extends keyof T, T> = Omit<T, K> & Partial<Pick<T, K>>;

