import json
import os
import shutil
from pathlib import Path
import cv2
import numpy as np
import yaml
import random
from PIL import Image, ImageEnhance

class JournalDetector:
    def __init__(self):
        self.base_dir = Path.cwd()
        self.dataset_dir = self.base_dir / 'dataset'
        self.images_dir = self.dataset_dir / 'images'
        self.labels_dir = self.dataset_dir / 'labels'
        self.sample_journals_dir = self.base_dir / 'SampleJournals'
        
        self.classes = ['date', 'title', 'journal_entry', 'main_image', 'sub_image']
        
        # Class weights based on inverse frequency
        self.class_weights = {
            'date': 5.0,      # Increased weight for rare date class
            'title': 4.0,     # Slightly increased for title
            'journal_entry': 2.0,
            'main_image': 2.0,
            'sub_image': 1.0  # Base weight for most common class
        }
        
        # Create directories
        self.dataset_dir.mkdir(parents=True, exist_ok=True)
        self.images_dir.mkdir(parents=True, exist_ok=True)
        self.labels_dir.mkdir(parents=True, exist_ok=True)
        
        # Split directories
        (self.images_dir / 'train').mkdir(exist_ok=True)
        (self.images_dir / 'val').mkdir(exist_ok=True)
        (self.labels_dir / 'train').mkdir(exist_ok=True)
        (self.labels_dir / 'val').mkdir(exist_ok=True)

    def augment_image(self, image, filename, regions):
        """Apply augmentation to image, focusing on date regions"""
        augmented_images = []
        augmented_regions = []
        
        # Original image and regions
        augmented_images.append(image)
        augmented_regions.append(regions)
        
        # Find date regions
        date_regions = [r for r in regions if r['region_attributes'].get('element_type') == 'date']
        
        if date_regions:
            # Brightness variation
            img_pil = Image.fromarray(image)
            for factor in [0.8, 1.2]:  # Slightly darker and brighter
                enhancer = ImageEnhance.Brightness(img_pil)
                aug_img = enhancer.enhance(factor)
                augmented_images.append(np.array(aug_img))
                augmented_regions.append(regions)
            
            # Contrast variation
            for factor in [0.9, 1.1]:  # Slightly lower and higher contrast
                enhancer = ImageEnhance.Contrast(img_pil)
                aug_img = enhancer.enhance(factor)
                augmented_images.append(np.array(aug_img))
                augmented_regions.append(regions)
        
        return augmented_images, augmented_regions

    def convert_rect_to_yolo(self, x, y, width, height, img_width, img_height):
        x_center = x + width/2
        y_center = y + height/2
        
        x_center /= img_width
        y_center /= img_height
        width /= img_width
        height /= img_height
        
        return [x_center, y_center, width, height]

    def process_via_annotations(self, json_file, split_ratio=0.8):
        print(f"Loading annotations from: {json_file}")
        with open(json_file, 'r') as f:
            via_data = json.load(f)
        
        image_data = via_data.get('_via_img_metadata', {})
        print(f"Found {len(image_data)} image entries")
        
        entries = []
        for key, value in image_data.items():
            filename = value['filename']
            entries.append((filename, value))
        
        np.random.shuffle(entries)
        split_idx = int(len(entries) * split_ratio)
        
        processed_count = 0
        augmented_count = 0
        
        for idx, (filename, entry) in enumerate(entries):
            subset = 'train' if idx < split_idx else 'val'
            
            src_path = self.sample_journals_dir / filename
            if not src_path.exists():
                print(f"Warning: Image not found: {src_path}")
                continue
            
            # Read image
            img = cv2.imread(str(src_path))
            if img is None:
                print(f"Error: Could not read image: {src_path}")
                continue
            
            # Generate augmented versions for training set
            if subset == 'train':
                aug_images, aug_regions = self.augment_image(img, filename, entry['regions'])
            else:
                aug_images, aug_regions = [img], [entry['regions']]
            
            # Process original and augmented images
            for aug_idx, (aug_img, aug_regions) in enumerate(zip(aug_images, aug_regions)):
                # Generate augmented filename
                aug_filename = f"{Path(filename).stem}_aug{aug_idx}{Path(filename).suffix}" if aug_idx > 0 else filename
                
                # Save augmented image
                dest_path = self.images_dir / subset / aug_filename
                cv2.imwrite(str(dest_path), aug_img)
                
                height, width = aug_img.shape[:2]
                
                # Create label file
                label_path = self.labels_dir / subset / f"{Path(aug_filename).stem}.txt"
                
                with label_path.open('w') as f:
                    for region in aug_regions:
                        shape_attrs = region['shape_attributes']
                        region_attrs = region['region_attributes']
                        
                        if shape_attrs.get('name') != 'rect':
                            continue
                        
                        element_type = region_attrs.get('element_type')
                        if not element_type or element_type not in self.classes:
                            continue
                        
                        x = shape_attrs['x']
                        y = shape_attrs['y']
                        w = shape_attrs['width']
                        h = shape_attrs['height']
                        
                        bbox = self.convert_rect_to_yolo(x, y, w, h, width, height)
                        class_idx = self.classes.index(element_type)
                        
                        # Apply class weighting
                        weight = self.class_weights.get(element_type, 1.0)
                        for _ in range(int(weight)):
                            f.write(f"{class_idx} {' '.join(map(str, bbox))}\n")
                
                if aug_idx > 0:
                    augmented_count += 1
                processed_count += 1
            
        print(f"Successfully processed {processed_count} images ({augmented_count} augmented)")

    def create_yaml(self):
        yaml_content = {
            'path': str(self.dataset_dir.absolute()),
            'train': str(self.images_dir / 'train'),
            'val': str(self.images_dir / 'val'),
            'nc': len(self.classes),
            'names': self.classes
        }
        
        yaml_path = self.dataset_dir / 'journal.yaml'
        with yaml_path.open('w') as f:
            yaml.safe_dump(yaml_content, f, sort_keys=False)
        
        return yaml_path

    def train(self, epochs=200, batch_size=16, img_size=640):
        yaml_path = self.create_yaml()
        
        print(f"Starting training with {epochs} epochs")
        print(f"Using configuration file: {yaml_path}")
        
        os.system(f"""
        python3 yolov5/train.py \
            --img {img_size} \
            --batch {batch_size} \
            --epochs {epochs} \
            --data {yaml_path} \
            --weights yolov5s.pt \
            --cache \
            --patience 50
        """)

def main():
    detector = JournalDetector()
    detector.process_via_annotations('labeled_journals.json')
    detector.train(epochs=200)

if __name__ == "__main__":
    main()