import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";

async function main() {
  const { publicKey, privateKey } = await generateKeyPair("Ed25519");
  const pkcs8 = await exportPKCS8(privateKey);
  const spki = await exportSPKI(publicKey);

  console.log("AGENT_ED25519_PRIVATE=");
  console.log(pkcs8);
  console.log("");
  console.log("AGENT_ED25519_PUBLIC_PEM=");
  console.log(spki);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
