import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";

type ListingGalleryProps = {
  images: { url: string; sort_index: number }[];
  alt: string;
  overlay?: React.ReactNode;
};

export function ListingGallery({ images, alt, overlay }: ListingGalleryProps) {
  return (
    <Card className="overflow-hidden border-border/60">
      <CardContent className="relative p-0">
        {images.length ? (
          <Carousel opts={{ loop: images.length > 1 }}>
            <CarouselContent>
              {images.map((img) => (
                <CarouselItem key={img.sort_index} className="basis-full">
                  <img src={img.url} alt={alt} className="h-80 w-full object-cover" />
                </CarouselItem>
              ))}
            </CarouselContent>
            {images.length > 1 && (
              <>
                <CarouselPrevious />
                <CarouselNext />
              </>
            )}
          </Carousel>
        ) : (
          <div className="flex h-80 items-center justify-center bg-muted text-sm text-muted-foreground">
            No images
          </div>
        )}
        {overlay}
      </CardContent>
    </Card>
  );
}
