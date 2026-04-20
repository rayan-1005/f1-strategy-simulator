import chalk from "chalk";

type Level = "info" | "ok" | "warn" | "error" | "debug";

function ts() {
  // Render/GitHub logs are easier to scan with ISO timestamps
  return new Date().toISOString();
}

function tag(service: string) {
  return chalk.gray(`[${ts()}]`) + " " + chalk.cyanBright(`[${service}]`);
}

export const log = {
  info(service: string, msg: string) {
    console.log(`${tag(service)} ${chalk.white(msg)}`);
  },
  ok(service: string, msg: string) {
    console.log(`${tag(service)} ${chalk.greenBright(msg)}`);
  },
  warn(service: string, msg: string) {
    console.warn(`${tag(service)} ${chalk.yellowBright(msg)}`);
  },
  error(service: string, msg: string, err?: unknown) {
    console.error(`${tag(service)} ${chalk.redBright(msg)}`);
    if (err) console.error(err);
  },
  debug(service: string, msg: string) {
    if (process.env.LOG_LEVEL === "debug") {
      console.log(`${tag(service)} ${chalk.magentaBright(msg)}`);
    }
  },
};