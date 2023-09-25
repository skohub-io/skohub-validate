import { describe, expect, it, vi } from "vitest";

describe("query", () => {
  it("returns a query result for v2", async () => {
    const req = {
      headers: {
        "content-type": "multipart/form-data"
      },
      body: {
        q1: {
          query: "dini-ag-kim",
        },
        q2: {
          query: "test"
        }
      },
      params: {},
    };
    const res = {
      send: vi.fn(),
      status: vi.fn(),
      json: vi.fn(),
    };
    await query(req, res);
    expect(res.status).toBeCalledWith(200);
    expect(res.json).toBeCalledWith(queryResponseV2);
  })
});
