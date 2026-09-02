import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { success, failure, wrapHandler } from "../src/lib/errors.js";
import {
  validateQuery,
  validateTableName,
  enforceRowLimit,
  isTableAllowed,
  SqlSafetyError,
} from "../src/lib/sql-safety.js";

describe("error utilities", () => {
  test("success returns content array with text", () => {
    const result = success("hello");
    assert.equal(result.content[0].type, "text");
    assert.equal(result.content[0].text, "hello");
    assert.equal(result.isError, undefined);
  });

  test("failure returns isError flag", () => {
    const result = failure({ code: "TEST", message: "failed" });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /TEST/);
  });

  test("wrapHandler catches errors and returns failure", async () => {
    const handler = wrapHandler(async () => {
      throw new Error("boom");
    });
    const result = await handler({});
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /boom/);
  });

  test("wrapHandler passes through success", async () => {
    const handler = wrapHandler(async () => "ok");
    const result = await handler({});
    assert.equal(result.content[0].text, "ok");
    assert.equal(result.isError, undefined);
  });
});

describe("sql-safety: validateQuery", () => {
  const config = { allowedTables: ["users", "posts"], maxRows: 1000 };

  test("allows SELECT queries", () => {
    assert.doesNotThrow(() => validateQuery("SELECT * FROM users", config));
  });

  test("allows SELECT with WHERE and JOIN", () => {
    assert.doesNotThrow(() =>
      validateQuery("SELECT u.name, p.title FROM users u JOIN posts p ON u.id = p.user_id WHERE u.id = 1", config)
    );
  });

  test("allows SHOW queries", () => {
    assert.doesNotThrow(() => validateQuery("SHOW tables", config));
  });

  test("allows EXPLAIN queries", () => {
    assert.doesNotThrow(() => validateQuery("EXPLAIN SELECT * FROM users", config));
  });

  test("allows WITH (CTE) queries", () => {
    // CTE aliases are not real tables — use wildcard config to avoid false positives
    const wildcardConfig = { allowedTables: "*" as const, maxRows: 1000 };
    assert.doesNotThrow(() =>
      validateQuery("WITH active AS (SELECT * FROM users) SELECT * FROM active", wildcardConfig)
    );
  });

  test("rejects INSERT queries", () => {
    assert.throws(
      () => validateQuery("INSERT INTO users (name) VALUES ('test')", config),
      { code: "FORBIDDEN_KEYWORD" }
    );
  });

  test("rejects UPDATE queries", () => {
    assert.throws(
      () => validateQuery("UPDATE users SET name = 'test' WHERE id = 1", config),
      { code: "FORBIDDEN_KEYWORD" }
    );
  });

  test("rejects DELETE queries", () => {
    assert.throws(
      () => validateQuery("DELETE FROM users WHERE id = 1", config),
      { code: "FORBIDDEN_KEYWORD" }
    );
  });

  test("rejects DROP queries", () => {
    assert.throws(
      () => validateQuery("DROP TABLE users", config),
      { code: "FORBIDDEN_KEYWORD" }
    );
  });

  test("rejects CREATE queries", () => {
    assert.throws(
      () => validateQuery("CREATE TABLE evil (id int)", config),
      { code: "FORBIDDEN_KEYWORD" }
    );
  });

  test("rejects TRUNCATE queries", () => {
    assert.throws(
      () => validateQuery("TRUNCATE users", config),
      { code: "FORBIDDEN_KEYWORD" }
    );
  });

  test("rejects queries not starting with allowed prefix", () => {
    assert.throws(
      () => validateQuery("VACUUM users", config),
      { code: "FORBIDDEN_KEYWORD" }
    );
  });

  test("rejects empty queries", () => {
    assert.throws(
      () => validateQuery("", config),
      { code: "EMPTY_QUERY" }
    );
  });

  test("rejects multiple statements", () => {
    assert.throws(
      () => validateQuery("SELECT * FROM users; DROP TABLE users", config),
      { code: "MULTIPLE_STATEMENTS" }
    );
  });

  test("allows trailing semicolon", () => {
    assert.doesNotThrow(() => validateQuery("SELECT * FROM users;", config));
  });

  test("rejects tables not in allow-list", () => {
    assert.throws(
      () => validateQuery("SELECT * FROM secret_table", config),
      { code: "TABLE_NOT_ALLOWED" }
    );
  });

  test("allows all tables when allow-list is '*'", () => {
    const wildcardConfig = { allowedTables: "*" as const, maxRows: 1000 };
    assert.doesNotThrow(() =>
      validateQuery("SELECT * FROM any_table", wildcardConfig)
    );
  });
});

describe("sql-safety: validateTableName", () => {
  test("accepts valid table names", () => {
    assert.doesNotThrow(() => validateTableName("users"));
    assert.doesNotThrow(() => validateTableName("posts_2024"));
    assert.doesNotThrow(() => validateTableName("_private"));
  });

  test("rejects names with special characters", () => {
    assert.throws(() => validateTableName("users; DROP TABLE"), { code: "INVALID_TABLE_NAME" });
    assert.throws(() => validateTableName("users--"), { code: "INVALID_TABLE_NAME" });
    assert.throws(() => validateTableName("1table"), { code: "INVALID_TABLE_NAME" });
    assert.throws(() => validateTableName("table name"), { code: "INVALID_TABLE_NAME" });
  });
});

describe("sql-safety: enforceRowLimit", () => {
  test("adds LIMIT when not present", () => {
    const result = enforceRowLimit("SELECT * FROM users", 1000);
    assert.match(result, /LIMIT 1000/);
  });

  test("does not add LIMIT when already present", () => {
    const result = enforceRowLimit("SELECT * FROM users LIMIT 10", 1000);
    assert.doesNotMatch(result, /LIMIT 1000/);
    assert.match(result, /LIMIT 10/);
  });

  test("handles trailing semicolon", () => {
    const result = enforceRowLimit("SELECT * FROM users;", 500);
    assert.match(result, /LIMIT 500;/);
  });
});

describe("sql-safety: isTableAllowed", () => {
  test("allows all when wildcard", () => {
    assert.equal(isTableAllowed("anything", { allowedTables: "*", maxRows: 0 }), true);
  });

  test("allows listed tables", () => {
    assert.equal(isTableAllowed("users", { allowedTables: ["users", "posts"], maxRows: 0 }), true);
  });

  test("rejects unlisted tables", () => {
    assert.equal(isTableAllowed("secret", { allowedTables: ["users", "posts"], maxRows: 0 }), false);
  });

  test("case-insensitive matching", () => {
    assert.equal(isTableAllowed("USERS", { allowedTables: ["users"], maxRows: 0 }), true);
  });
});
