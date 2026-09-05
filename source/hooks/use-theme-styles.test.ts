import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import ReactTestRenderer, { ReactTestRenderer as Renderer } from "react-test-renderer";
import Module from "node:module";

// Mock implementation using CommonJS Module.prototype.require intercept
// as per the codebase memory for native node tests with transpilation limitations.
const originalRequire = Module.prototype.require;

let currentResolvedTheme = "light";
let mockGetThemeTokensCalls: string[] = [];

Module.prototype.require = function (id: string) {
  if (id === "@/constants/theme-tokens") {
    return {
      getThemeTokens: (resolvedTheme: string) => {
        mockGetThemeTokensCalls.push(resolvedTheme);
        return { mockTokenKey: `mockTokenValue-${resolvedTheme}` };
      },
    };
  }

  if (id === "./use-app-theme") {
    return {
      useAppTheme: () => ({
        resolvedTheme: currentResolvedTheme,
      }),
    };
  }

  return originalRequire.apply(this, arguments as any);
};

// We must import the hook after the mocks are set up
const { useThemeStyles } = require("./use-theme-styles");

function TestComponent({ theme }: { theme: "light" | "dark" }) {
  currentResolvedTheme = theme;
  const styles = useThemeStyles();
  return React.createElement("div", { ...styles });
}

test("useThemeStyles correctly returns memoized tokens based on light resolvedTheme", () => {
  mockGetThemeTokensCalls = [];

  let root: Renderer | undefined;
  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(React.createElement(TestComponent, { theme: "light" }));
  });

  const tree = root?.toJSON();
  assert.equal(tree && !Array.isArray(tree) ? tree.props.mockTokenKey : null, "mockTokenValue-light");
  assert.equal(mockGetThemeTokensCalls.length, 1);
  assert.deepEqual(mockGetThemeTokensCalls, ["light"]);

  // Re-render with same theme to test useMemo
  ReactTestRenderer.act(() => {
    root?.update(React.createElement(TestComponent, { theme: "light" }));
  });
  assert.equal(mockGetThemeTokensCalls.length, 1); // Should still be 1
});

test("useThemeStyles correctly re-computes tokens on dark resolvedTheme", () => {
  mockGetThemeTokensCalls = [];

  let root: Renderer | undefined;
  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(React.createElement(TestComponent, { theme: "dark" }));
  });

  let tree = root?.toJSON();
  assert.equal(tree && !Array.isArray(tree) ? tree.props.mockTokenKey : null, "mockTokenValue-dark");
  assert.equal(mockGetThemeTokensCalls.length, 1);
  assert.deepEqual(mockGetThemeTokensCalls, ["dark"]);

  // Re-render with light theme to test useMemo dependency change
  ReactTestRenderer.act(() => {
    root?.update(React.createElement(TestComponent, { theme: "light" }));
  });

  tree = root?.toJSON();
  assert.equal(tree && !Array.isArray(tree) ? tree.props.mockTokenKey : null, "mockTokenValue-light");
  assert.equal(mockGetThemeTokensCalls.length, 2); // Should compute light tokens
  assert.deepEqual(mockGetThemeTokensCalls, ["dark", "light"]);
});
