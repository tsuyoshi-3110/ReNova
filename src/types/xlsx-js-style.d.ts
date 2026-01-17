// xlsx-js-style は API が xlsx と互換なので、xlsx の型をそのまま再利用します。
declare module "xlsx-js-style" {
  export * from "xlsx";
  // default export も xlsx と同じシグネチャにしておく
  const XLSX: typeof import("xlsx");
  export default XLSX;
}
