import type { JSX } from "react"; // React 19 bỏ global JSX namespace → import từ react
import { DecoratorNode } from "lexical";
import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";

export type SerializedImageNode = Spread<
  { src: string; altText: string },
  SerializedLexicalNode
>;

/**
 * Node ảnh cho Lexical (không có sẵn). Hỗ trợ export/import DOM để round-trip
 * HTML — quan trọng vì HTML là cầu nối nạp nội dung giữa Tiptap và Lexical.
 */
export class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __alt: string;

  static getType(): string {
    return "image";
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__alt, node.__key);
  }

  constructor(src: string, alt: string, key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__alt = alt;
  }

  createDOM(): HTMLElement {
    const span = document.createElement("span");
    span.style.display = "inline-block";
    return span;
  }

  updateDOM(): false {
    return false;
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: () => ({
        conversion: (element: HTMLElement): DOMConversionOutput => {
          const img = element as HTMLImageElement;
          return { node: $createImageNode(img.getAttribute("src") ?? "", img.getAttribute("alt") ?? "") };
        },
        priority: 0,
      }),
    };
  }

  exportDOM(): DOMExportOutput {
    const img = document.createElement("img");
    img.setAttribute("src", this.__src);
    img.setAttribute("alt", this.__alt);
    return { element: img };
  }

  static importJSON(json: SerializedImageNode): ImageNode {
    return $createImageNode(json.src, json.altText);
  }

  exportJSON(): SerializedImageNode {
    return { type: "image", version: 1, src: this.__src, altText: this.__alt };
  }

  decorate(): JSX.Element {
    return <img src={this.__src} alt={this.__alt} style={{ maxWidth: "100%", height: "auto" }} />;
  }
}

export function $createImageNode(src: string, altText = ""): ImageNode {
  return new ImageNode(src, altText);
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode;
}
