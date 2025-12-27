import { deviceLogin, logout, setupLocalDevAuth, status } from "../cli/auth";
import { elevate } from "../cli/biometric";

export async function authCommands(args: string[]): Promise<void> {
  const command = args[0];

  switch (command) {
    case "login":
      await deviceLogin();
      break;
    case "local":
      await setupLocalDevAuth();
      break;
    case "logout":
      await logout();
      break;
    case "status":
      await status();
      break;
    case "elevate":
      await elevate();
      break;
    default:
      throw new Error("tui_auth_command_invalid");
  }
}
