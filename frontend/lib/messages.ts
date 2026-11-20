import uk from "@/messages/uk.json";

// Single-locale copy lookup: t("uiKit.title"). Add keys to messages/uk.json; no language switcher is planned.
type Dict = { [key: string]: string | Dict };

export function t(key: string): string {
	let node: string | Dict | undefined = uk as Dict;
	for (const part of key.split(".")) {
		if (typeof node !== "object" || node === undefined) return key;
		node = node[part];
	}
	return typeof node === "string" ? node : key;
}
