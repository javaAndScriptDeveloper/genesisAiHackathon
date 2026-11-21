export class AiConfigError extends Error {
	constructor(readonly envVar: string) {
		super(`Missing ${envVar}. Add it to .env.local.`);
		this.name = "AiConfigError";
	}
}
