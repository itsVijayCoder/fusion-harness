import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
	{ ignores: ["cloudflare-env.d.ts", ".next/**", ".open-next/**", "out/**"] },
	...nextCoreWebVitals,
	...nextTypescript,
];

export default eslintConfig;
