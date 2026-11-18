import { stdin, stdout } from "node:process";

function readHidden(prompt: string): Promise<string> {
  if (!stdin.isTTY) {
    throw new Error("Run this command in an interactive terminal to enter a password safely.");
  }

  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();

  return new Promise((resolve, reject) => {
    let value = "";
    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
    };
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString()) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Password entry cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          resolve(value);
          return;
        }
        if (character === "\u007f") {
          value = value.slice(0, -1);
        } else {
          value += character;
        }
      }
    };

    stdin.on("data", onData);
  });
}

export async function promptForPassword() {
  const password = await readHidden("Password (at least 12 characters): ");
  const confirmation = await readHidden("Confirm password: ");
  if (password.length < 12 || password.length > 128) {
    throw new Error("Password must contain 12 to 128 characters.");
  }
  if (password !== confirmation) {
    throw new Error("Passwords do not match.");
  }
  return password;
}
