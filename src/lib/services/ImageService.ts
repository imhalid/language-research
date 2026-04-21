import { db } from '../db';
import { withTimestamps, withUpdatedAt } from '../utils/date';
import type { Image } from '../../types/domain.types';
import type { ImageRecord } from '../../types/research.types';

const resolveImageNodePosition = async (
  chapterId: number,
  paragraphId: number
): Promise<{ x: number; y: number }> => {
  const [nodes, imageIds] = await Promise.all([
    db.canvasNodes.where('chapterId').equals(chapterId).toArray(),
    db.images.where('paragraphId').equals(paragraphId).primaryKeys() as Promise<number[]>
  ]);
  const paragraphNode = nodes.find(
    (node) => node.entityType === 'paragraph' && node.entityId === paragraphId
  );
  const siblingCount = nodes.filter(
    (node) => node.entityType === 'image' && imageIds.includes(node.entityId)
  ).length;

  return {
    x: (paragraphNode?.x ?? -120) + 360,
    y: (paragraphNode?.y ?? 0) + siblingCount * 148
  };
};

const toRecord = (images: Image[]): ImageRecord[] =>
  images
    .filter((image): image is ImageRecord => image.id != null)
    .map((image) => ({ ...image, id: image.id }));

export class ImageService {
  static async create(input: {
    chapterId: number;
    paragraphId: number;
    file: File;
  }): Promise<number> {
    const position = await resolveImageNodePosition(input.chapterId, input.paragraphId);
    const caption = input.file.name.replace(/\.[^.]+$/, '') || input.file.name;

    return db.transaction('rw', [db.images, db.canvasNodes], async () => {
      const imageId = await db.images.add(
        withTimestamps({
          paragraphId: input.paragraphId,
          blob: input.file,
          caption,
          notes: ''
        })
      );

      await db.canvasNodes.add({
        entityType: 'image',
        entityId: imageId,
        x: position.x,
        y: position.y,
        chapterId: input.chapterId
      });

      return imageId;
    });
  }

  static async listByParagraph(paragraphId: number): Promise<ImageRecord[]> {
    const images = await db.images.where('paragraphId').equals(paragraphId).toArray();
    return toRecord(images).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  static async get(imageId: number): Promise<ImageRecord | null> {
    const image = await db.images.get(imageId);
    return image?.id != null ? { ...image, id: image.id } : null;
  }

  static async update(
    imageId: number,
    data: Partial<Pick<Image, 'caption' | 'notes'>>
  ): Promise<void> {
    await db.images.update(imageId, withUpdatedAt(data));
  }

  static async delete(imageId: number): Promise<void> {
    await db.transaction('rw', [db.images, db.canvasNodes], async () => {
      const nodeIds = (await db.canvasNodes.toArray())
        .filter((node) => node.entityType === 'image' && node.entityId === imageId)
        .flatMap((node) => (node.id ? [node.id] : []));

      if (nodeIds.length > 0) await db.canvasNodes.bulkDelete(nodeIds);
      await db.images.delete(imageId);
    });
  }
}
