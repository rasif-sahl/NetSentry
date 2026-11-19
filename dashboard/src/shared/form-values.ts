export const text = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();
export const number = (form: FormData, key: string) => Number(form.get(key));
