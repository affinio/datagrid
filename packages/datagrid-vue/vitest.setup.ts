type CanvasContext2DStub = Pick<
  CanvasRenderingContext2D,
  | "arc"
  | "beginPath"
  | "clearRect"
  | "clip"
  | "closePath"
  | "fill"
  | "fillRect"
  | "fillText"
  | "lineTo"
  | "measureText"
  | "moveTo"
  | "quadraticCurveTo"
  | "rect"
  | "restore"
  | "save"
  | "setLineDash"
  | "setTransform"
  | "stroke"
> & {
  canvas: HTMLCanvasElement | null
  fillStyle: string
  font: string
  globalAlpha: number
  lineWidth: number
  strokeStyle: string
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
}

function createCanvas2DContextStub(canvas: HTMLCanvasElement | null): CanvasRenderingContext2D {
  const noop = (): void => undefined
  const stub: CanvasContext2DStub = {
    canvas,
    fillStyle: "#000000",
    font: "12px sans-serif",
    globalAlpha: 1,
    lineWidth: 1,
    strokeStyle: "#000000",
    textAlign: "left",
    textBaseline: "alphabetic",
    arc: noop,
    beginPath: noop,
    clearRect: noop,
    clip: noop,
    closePath: noop,
    fill: noop,
    fillRect: noop,
    fillText: noop,
    lineTo: noop,
    measureText: (text: string) => ({ width: text.length * 7 } as TextMetrics),
    moveTo: noop,
    quadraticCurveTo: noop,
    rect: noop,
    restore: noop,
    save: noop,
    setLineDash: noop,
    setTransform: noop,
    stroke: noop,
  }
  return stub as CanvasRenderingContext2D
}

if (typeof HTMLCanvasElement !== "undefined") {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    writable: true,
    value(this: HTMLCanvasElement, contextId: string): RenderingContext | null {
      if (contextId !== "2d") {
        return null
      }
      return createCanvas2DContextStub(this)
    },
  })
}