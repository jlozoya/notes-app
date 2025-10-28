import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import { act } from "react";
import RichEditor from "../RichEditor";
import { useEditorBridge } from "@10play/tentap-editor";

const mockedUseEditorBridge = useEditorBridge as jest.Mock;

let realSetTimeout: typeof setTimeout;

beforeEach(() => {
  mockedUseEditorBridge.mockReset();
  realSetTimeout = global.setTimeout;
  // @ts-ignore
  global.setTimeout = (fn: any) => { fn?.(); return 0 as any; };
});

afterEach(() => {
  global.setTimeout = realSetTimeout;
});

describe("RichEditor", () => {
  test(
    "renders toolbar and calls onChangeHtml when content changes (debounced)",
    async () => {
      const onChangeHtml = jest.fn();

      mockedUseEditorBridge.mockImplementation((_opts?: any) => ({
        getHTML: jest.fn().mockResolvedValue("<p>changed</p>"),
        setContent: jest.fn().mockResolvedValue(undefined),
      }));

      const { getByTestId } = render(
        <RichEditor initialContent="<p>initial</p>" onChangeHtml={onChangeHtml} />
      );
      expect(getByTestId("toolbar")).toBeTruthy();

      const opts = mockedUseEditorBridge.mock.calls[0][0];
      await act(async () => {
        opts?.onChange?.();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(onChangeHtml).toHaveBeenCalledWith("<p>changed</p>");
      });
    },
    10000
  );

  test(
    "does not re-emit when content didn't change",
    async () => {
      const onChangeHtml = jest.fn();

      mockedUseEditorBridge.mockImplementation((_opts?: any) => ({
        getHTML: jest.fn().mockResolvedValue("<p>same</p>"),
        setContent: jest.fn().mockResolvedValue(undefined),
      }));

      render(<RichEditor initialContent="<p>same</p>" onChangeHtml={onChangeHtml} />);

      const opts = mockedUseEditorBridge.mock.calls[0][0];
      await act(async () => {
        opts?.onChange?.();
        await Promise.resolve();
      });

      expect(onChangeHtml).not.toHaveBeenCalled();
    },
    10000
  );
});
