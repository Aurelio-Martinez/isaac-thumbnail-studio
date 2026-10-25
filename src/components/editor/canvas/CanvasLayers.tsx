import { Group, Image as KonvaImage, Layer as KonvaLayer, Rect, Text } from "react-konva";
import type Konva from "konva";
import type { ImageLayer, SceneBackground, TextLayer } from "@/features/editor/types";
import { useAssetImage } from "@/features/assets/imageRegistry";
import { useOutlinedImage } from "@/components/editor/canvas/useOutlinedImage";

interface NodeCallbacks {
  registerNode: (id: string, node: Konva.Group | null) => void;
  onSelect: (id: string, additive: boolean) => void;
  onDragStart: (id: string) => void;
  onDragMove: (id: string, node: Konva.Group) => void;
  onDragEnd: (id: string, node: Konva.Group) => void;
  onDoubleClickText?: (id: string) => void;
}

function setCursor(node: Konva.Node, cursor: string): void {
  const stage = node.getStage();
  if (stage) stage.container().style.cursor = cursor;
}

function nodeEvents(layer: ImageLayer | TextLayer, callbacks: NodeCallbacks) {
  return {
    onMouseDown: (event: Konva.KonvaEventObject<MouseEvent>) => {
      event.cancelBubble = true;
      callbacks.onSelect(layer.id, event.evt.shiftKey);
    },
    onTouchStart: (event: Konva.KonvaEventObject<TouchEvent>) => {
      event.cancelBubble = true;
      callbacks.onSelect(layer.id, false);
    },
    onMouseEnter: (event: Konva.KonvaEventObject<MouseEvent>) => {
      setCursor(event.target, layer.locked ? "pointer" : "move");
    },
    onMouseLeave: (event: Konva.KonvaEventObject<MouseEvent>) => {
      setCursor(event.target, "default");
    },
    onDragStart: () => callbacks.onDragStart(layer.id),
    onDragMove: (event: Konva.KonvaEventObject<DragEvent>) =>
      callbacks.onDragMove(layer.id, event.target as unknown as Konva.Group),
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) =>
      callbacks.onDragEnd(layer.id, event.target as unknown as Konva.Group),
  };
}

function Placeholder({
  layer,
  callbacks,
  message,
  tone = "muted",
}: {
  layer: ImageLayer;
  callbacks: NodeCallbacks;
  message: string;
  tone?: "muted" | "error";
}) {
  return (
    <Group
      id={layer.id}
      x={layer.x}
      y={layer.y}
      offsetX={layer.width / 2}
      offsetY={layer.height / 2}
      rotation={layer.rotation}
      opacity={layer.opacity}
      visible={layer.visible}
      draggable={!layer.locked}
      ref={(node) => callbacks.registerNode(layer.id, node)}
      {...nodeEvents(layer, callbacks)}
    >
      <Rect
        name="hit-area"
        width={layer.width}
        height={layer.height}
        fill="rgba(0,0,0,0.001)"
        stroke={tone === "error" ? "#d9482f" : "#3a3a46"}
        strokeWidth={1}
        dash={[6, 4]}
      />
      <Text
        width={layer.width}
        y={layer.height / 2 - 10}
        align="center"
        text={message}
        fontFamily="Inter"
        fontSize={Math.max(11, Math.min(18, layer.width / 12))}
        fill={tone === "error" ? "#e58b78" : "#948d81"}
        listening={false}
      />
      <Text
        width={layer.width}
        y={layer.height / 2 + 8}
        align="center"
        text={layer.name}
        fontFamily="Inter"
        fontSize={Math.max(9, Math.min(13, layer.width / 16))}
        fill="#6f6960"
        listening={false}
      />
    </Group>
  );
}

export function ImageLayerNode({
  layer,
  callbacks,
}: {
  layer: ImageLayer;
  callbacks: NodeCallbacks;
}) {
  const entry = useAssetImage(layer.asset.imageUrl);
  const userImage = entry?.status === "loaded" ? entry.image : null;
  const outline = useOutlinedImage(
    userImage,
    layer.width,
    layer.height,
    layer.effects.outline.color,
    Math.max(1, layer.effects.outline.width),
    layer.flipX,
    layer.flipY,
    layer.effects.outline.enabled,
  );

  if (!layer.asset.imageUrl) {
    return (
      <Placeholder
        layer={layer}
        callbacks={callbacks}
        message="Missing uploaded image"
        tone="error"
      />
    );
  }
  if (entry && entry.status === "error") {
    return (
      <Placeholder layer={layer} callbacks={callbacks} message="Image unavailable" tone="error" />
    );
  }
  if (!userImage) {
    return <Placeholder layer={layer} callbacks={callbacks} message="Loading image…" />;
  }

  const shadow = layer.effects.shadow;
  const glow = layer.effects.glow;
  const commonImage = {
    image: userImage,
    x: layer.width / 2,
    y: layer.height / 2,
    width: layer.width,
    height: layer.height,
    offsetX: layer.width / 2,
    offsetY: layer.height / 2,
    scaleX: layer.flipX ? -1 : 1,
    scaleY: layer.flipY ? -1 : 1,
    listening: false,
    perfectDrawEnabled: false,
  } as const;

  return (
    <Group
      id={layer.id}
      x={layer.x}
      y={layer.y}
      offsetX={layer.width / 2}
      offsetY={layer.height / 2}
      rotation={layer.rotation}
      opacity={layer.opacity}
      visible={layer.visible}
      draggable={!layer.locked}
      ref={(node) => callbacks.registerNode(layer.id, node)}
      {...nodeEvents(layer, callbacks)}
    >
      <Rect name="hit-area" width={layer.width} height={layer.height} fill="rgba(0,0,0,0.001)" />

      {glow.enabled ? (
        <KonvaImage
          {...commonImage}
          shadowEnabled
          shadowColor={glow.color}
          shadowBlur={glow.blur}
          shadowOpacity={glow.opacity}
          shadowOffsetX={0}
          shadowOffsetY={0}
        />
      ) : null}

      {layer.effects.outline.enabled && outline.canvas ? (
        <KonvaImage
          image={outline.canvas}
          x={-outline.pad}
          y={-outline.pad}
          width={Math.round(layer.width) + outline.pad * 2}
          height={Math.round(layer.height) + outline.pad * 2}
          listening={false}
          perfectDrawEnabled={false}
        />
      ) : null}

      <KonvaImage
        {...commonImage}
        shadowEnabled={shadow.enabled}
        shadowColor={shadow.color}
        shadowBlur={shadow.blur}
        shadowOpacity={shadow.opacity}
        shadowOffsetX={shadow.offsetX}
        shadowOffsetY={shadow.offsetY}
      />
    </Group>
  );
}

export function TextLayerNode({
  layer,
  callbacks,
}: {
  layer: TextLayer;
  callbacks: NodeCallbacks;
}) {
  const outline = layer.effects.outline;
  const shadow = layer.effects.shadow;
  const glow = layer.effects.glow;
  const textProps = {
    text: layer.text,
    width: layer.width,
    height: layer.height,
    fontFamily: layer.fontFamily,
    fontSize: layer.fontSize,
    fontStyle: String(layer.fontWeight),
    fontVariant: "normal",
    letterSpacing: layer.letterSpacing,
    lineHeight: layer.lineHeight,
    align: layer.align,
    verticalAlign: "middle" as const,
    wrap: "word" as const,
    padding: 0,
    fill: layer.color,
    stroke: outline.enabled ? outline.color : undefined,
    strokeWidth: outline.enabled ? outline.width : 0,
    fillAfterStrokeEnabled: true,
    listening: false,
    perfectDrawEnabled: false,
  };

  return (
    <Group
      id={layer.id}
      x={layer.x}
      y={layer.y}
      offsetX={layer.width / 2}
      offsetY={layer.height / 2}
      rotation={layer.rotation}
      opacity={layer.opacity}
      visible={layer.visible}
      draggable={!layer.locked}
      ref={(node) => callbacks.registerNode(layer.id, node)}
      {...nodeEvents(layer, callbacks)}
      onDblClick={() => callbacks.onDoubleClickText?.(layer.id)}
      onDblTap={() => callbacks.onDoubleClickText?.(layer.id)}
    >
      <Rect name="hit-area" width={layer.width} height={layer.height} fill="rgba(0,0,0,0.001)" />
      {glow.enabled ? (
        <Text
          {...textProps}
          shadowEnabled
          shadowColor={glow.color}
          shadowBlur={glow.blur}
          shadowOpacity={glow.opacity}
          shadowOffsetX={0}
          shadowOffsetY={0}
        />
      ) : null}
      {shadow.enabled ? (
        <Text
          {...textProps}
          shadowEnabled
          shadowColor={shadow.color}
          shadowBlur={shadow.blur}
          shadowOpacity={shadow.opacity}
          shadowOffsetX={shadow.offsetX}
          shadowOffsetY={shadow.offsetY}
        />
      ) : null}
      <Text {...textProps} />
    </Group>
  );
}

export function BackgroundLayer({
  background,
  registerNode,
}: {
  background: SceneBackground;
  registerNode: (node: Konva.Layer | null) => void;
}) {
  const entry = useAssetImage(background.mode === "image" ? background.asset?.imageUrl : null);
  const image = entry?.status === "loaded" ? entry.image : null;
  const asset = background.asset;
  const naturalWidth = image?.naturalWidth ?? asset?.width ?? 1280;
  const naturalHeight = image?.naturalHeight ?? asset?.height ?? 720;

  let imageProps: {
    x: number;
    y: number;
    width: number;
    height: number;
    crop?: { x: number; y: number; width: number; height: number };
  } | null = null;

  if (image && background.mode === "image") {
    if (background.fit === "cover") {
      const target = 1280 / 720;
      const source = naturalWidth / naturalHeight;
      if (source > target) {
        const cropWidth = naturalHeight * target;
        imageProps = {
          x: 0,
          y: 0,
          width: 1280,
          height: 720,
          crop: {
            x: (naturalWidth - cropWidth) / 2,
            y: 0,
            width: cropWidth,
            height: naturalHeight,
          },
        };
      } else {
        const cropHeight = naturalWidth / target;
        imageProps = {
          x: 0,
          y: 0,
          width: 1280,
          height: 720,
          crop: {
            x: 0,
            y: (naturalHeight - cropHeight) / 2,
            width: naturalWidth,
            height: cropHeight,
          },
        };
      }
    } else {
      const scale = Math.min(1280 / naturalWidth, 720 / naturalHeight);
      const width = naturalWidth * scale;
      const height = naturalHeight * scale;
      imageProps = {
        x: (1280 - width) / 2,
        y: (720 - height) / 2,
        width,
        height,
      };
    }
  }

  return (
    <BackgroundLayerGroup
      background={background}
      image={image}
      imageProps={imageProps}
      registerNode={registerNode}
      loading={Boolean(entry && entry.status === "loading")}
      failed={Boolean(entry && entry.status === "error")}
    />
  );
}

function BackgroundLayerGroup({
  background,
  image,
  imageProps,
  registerNode,
  loading,
  failed,
}: {
  background: SceneBackground;
  image: HTMLImageElement | null;
  imageProps: { x: number; y: number; width: number; height: number } | null;
  registerNode: (node: Konva.Layer | null) => void;
  loading: boolean;
  failed: boolean;
}) {
  return (
    <KonvaLayer
      name="background"
      listening={false}
      imageSmoothingEnabled
      ref={(node) => registerNode(node)}
    >
      {background.mode === "color" ? (
        <Rect width={1280} height={720} fill={background.color} />
      ) : null}
      {image && imageProps ? (
        <KonvaImage
          image={image}
          {...imageProps}
          opacity={background.opacity}
          listening={false}
          perfectDrawEnabled={false}
        />
      ) : null}
      {background.mode !== "transparent" && background.dim > 0 ? (
        <Rect width={1280} height={720} fill="#000000" opacity={background.dim} />
      ) : null}
      {background.mode !== "transparent" && background.vignette ? (
        <Rect
          width={1280}
          height={720}
          fillRadialGradientStartPoint={{ x: 640, y: 346 }}
          fillRadialGradientEndPoint={{ x: 640, y: 346 }}
          fillRadialGradientStartRadius={180}
          fillRadialGradientEndRadius={760}
          fillRadialGradientColorStops={[
            0,
            "rgba(0,0,0,0)",
            0.55,
            "rgba(0,0,0,0)",
            1,
            "rgba(0,0,0,0.6)",
          ]}
        />
      ) : null}
      {loading && background.mode === "image" ? (
        <Text
          x={0}
          y={688}
          width={1280}
          align="center"
          text="Loading background image…"
          fontFamily="Inter"
          fontSize={13}
          fill="#948d81"
        />
      ) : null}
      {failed && background.mode === "image" ? (
        <Text
          x={0}
          y={688}
          width={1280}
          align="center"
          text="Background image unavailable — choose another or upload one"
          fontFamily="Inter"
          fontSize={13}
          fill="#e58b78"
        />
      ) : null}
    </KonvaLayer>
  );
}
