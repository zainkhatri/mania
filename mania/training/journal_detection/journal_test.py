import torch
import cv2
import numpy as np
from pathlib import Path
import argparse

class JournalTester:
    def __init__(self, weights_path='yolov5/runs/train/exp7/weights/best.pt'):
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        print(f"Using device: {self.device}")
        
        # Load model
        self.model = torch.hub.load('ultralytics/yolov5', 'custom', weights_path)
        self.model.eval()
        
        # Class names and colors
        self.classes = ['date', 'title', 'journal_entry', 'main_image', 'sub_image']
        self.colors = {
            'date': (255, 0, 0),      # Blue
            'title': (0, 255, 0),     # Green
            'journal_entry': (0, 0, 255),  # Red
            'main_image': (255, 165, 0),   # Orange
            'sub_image': (128, 0, 128)     # Purple
        }

    def process_image(self, image_path, conf_threshold=0.5):
        """Process a single journal image and display results"""
        # Read image
        img = cv2.imread(str(image_path))
        if img is None:
            print(f"Error: Could not read image: {image_path}")
            return
        
        # Make prediction
        results = self.model(img)
        predictions = results.xyxy[0].cpu().numpy()  # x1, y1, x2, y2, confidence, class
        
        # Create copy for visualization
        img_display = img.copy()
        
        # Dictionary to store detected regions by class
        detections = {class_name: [] for class_name in self.classes}
        
        # Process each detection
        for x1, y1, x2, y2, conf, class_id in predictions:
            if conf >= conf_threshold:
                class_name = self.classes[int(class_id)]
                color = self.colors[class_name]
                
                # Draw rectangle
                cv2.rectangle(img_display, 
                            (int(x1), int(y1)), 
                            (int(x2), int(y2)), 
                            color, 2)
                
                # Add label
                label = f"{class_name} {conf:.2f}"
                cv2.putText(img_display, label, 
                          (int(x1), int(y1-5)), 
                          cv2.FONT_HERSHEY_SIMPLEX, 
                          0.5, color, 2)
                
                # Store detection
                detections[class_name].append({
                    'confidence': conf,
                    'bbox': [int(x1), int(y1), int(x2), int(y2)]
                })
        
        # Display summary
        print(f"\nResults for {image_path.name}:")
        for class_name, dets in detections.items():
            if dets:
                print(f"{class_name}: {len(dets)} detections")
                for i, det in enumerate(dets, 1):
                    print(f"  {i}. Confidence: {det['confidence']:.2f}")
        
        # Save results
        output_path = Path('results') / f"detected_{image_path.name}"
        output_path.parent.mkdir(exist_ok=True)
        cv2.imwrite(str(output_path), img_display)
        print(f"\nAnnotated image saved to: {output_path}")
        
        return detections

def main():
    parser = argparse.ArgumentParser(description='Test Journal Detection Model')
    parser.add_argument('--image', type=str, help='Path to journal image')
    parser.add_argument('--dir', type=str, help='Path to directory of journal images')
    parser.add_argument('--conf', type=float, default=0.5, help='Confidence threshold')
    args = parser.parse_args()

    tester = JournalTester()

    if args.image:
        # Process single image
        image_path = Path(args.image)
        tester.process_image(image_path, args.conf)
    
    elif args.dir:
        # Process directory of images
        image_dir = Path(args.dir)
        for image_path in image_dir.glob('*.jpg'):
            print(f"\nProcessing {image_path.name}")
            tester.process_image(image_path, args.conf)
    
    else:
        print("Please provide either --image or --dir argument")

if __name__ == "__main__":
    main()