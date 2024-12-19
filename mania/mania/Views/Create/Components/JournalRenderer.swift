import SwiftUI
import UIKit

struct JournalRenderer {
    static let pageWidth: CGFloat = 217.64
    static let pageHeight: CGFloat = 319.53
    static let margin: CGFloat = 5
    
    private static func calculateHeaderFontSizes(
        date: String,
        title: String,
        location: String,
        maxWidth: CGFloat
    ) -> (dateFontSize: CGFloat, titleFontSize: CGFloat) {
        let dateFontSize = calculateFittingFontSize(
            for: date.uppercased(),
            in: maxWidth,
            baseSize: 24,
            font: "Zain-Regular"
        )
        
        let headerText = "\(title), \(location)"
        let titleFontSize = calculateFittingFontSize(
            for: headerText,
            in: maxWidth,
            baseSize: 22,
            font: "Zain-Regular"
        )
        
        return (dateFontSize, titleFontSize)
    }
    
    static func calculateFittingFontSize(
        for text: String,
        in width: CGFloat,
        baseSize: CGFloat,
        font: String,
        minimumSize: CGFloat = 8
    ) -> CGFloat {
        let targetWidth = width - (margin * 2)
        var fontSize = baseSize
        
        while fontSize > minimumSize {
            let testFont = UIFont(name: font, size: fontSize)!
            let attributes: [NSAttributedString.Key: Any] = [
                .font: testFont,
                .kern: -1.5
            ]
            
            let size = (text as NSString).size(withAttributes: attributes)
            
            if size.width <= targetWidth {
                break
            }
            
            fontSize -= 0.5
        }
        
        return fontSize
    }
    
    static func renderJournal(
        date: String,
        title: String,
        location: String,
        content: String,
        mainImage: UIImage?,
        overlayPhotos: [DraggablePhoto]?
    ) -> UIImage? {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: pageWidth, height: pageHeight))
        
        return renderer.image { context in
            // Background
            UIColor(red: 255/255, green: 253/255, blue: 235/255, alpha: 1.0).setFill()
            context.fill(CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight))
            
            // Calculate font sizes for header elements
            let (dateFontSize, titleFontSize) = calculateHeaderFontSizes(
                date: date,
                title: title,
                location: location,
                maxWidth: pageWidth - (margin * 2)
            )
            
            // Header text styles
            let headerStyle = NSMutableParagraphStyle()
            headerStyle.alignment = .natural
            headerStyle.lineBreakMode = .byTruncatingTail
            
            // Draw date - Minimal top margin
            let dateAttributes: [NSAttributedString.Key: Any] = [
                .font: UIFont(name: "Zain-Regular", size: dateFontSize)!,
                .foregroundColor: UIColor.black,
                .kern: -1.5,
                .paragraphStyle: headerStyle
            ]
            
            let dateRect = CGRect(x: margin, y: margin - 2, // Reduced top margin
                                width: pageWidth - (margin * 2),
                                height: dateFontSize)
            date.uppercased().draw(in: dateRect, withAttributes: dateAttributes)
            
            // Draw title and location - Overlap with date
            let headerText = "\(title), \(location)"
            let locationAttributes: [NSAttributedString.Key: Any] = [
                .font: UIFont(name: "Zain-Regular", size: titleFontSize)!,
                .foregroundColor: UIColor.red,
                .kern: -1.5,
                .paragraphStyle: headerStyle
            ]
            
            let headerRect = CGRect(x: margin, y: dateRect.maxY - 6, // Overlap with date
                                  width: pageWidth - (margin * 2),
                                  height: titleFontSize)
            headerText.draw(in: headerRect, withAttributes: locationAttributes)
            
            // Content layout - Minimal spacing
            let contentStartY = headerRect.maxY - 4 // Overlap with header
            var imageHeight: CGFloat = 0
            var imageWidth: CGFloat = 0
            
            // Handle main image
            if let mainImage = mainImage {
                let maxImageWidth = pageWidth * 0.45
                let maxImageHeight: CGFloat = 100
                let aspectRatio = mainImage.size.width / mainImage.size.height
                imageWidth = min(maxImageWidth, maxImageHeight * aspectRatio)
                imageHeight = imageWidth / aspectRatio
                
                let imageRect = CGRect(x: margin, y: contentStartY - 2, // Slight overlap
                                     width: imageWidth,
                                     height: imageHeight)
                mainImage.draw(in: imageRect)
            }
            
            // Content text style with wrapping
            let contentStyle = NSMutableParagraphStyle()
            contentStyle.alignment = .natural
            contentStyle.lineBreakMode = .byWordWrapping
            contentStyle.lineSpacing = 6
            
            // Calculate available height for content
            let availableHeight = pageHeight - contentStartY - margin
            let contentLength = content.count

            // Adjusted font size settings
            let baseFontSize: CGFloat = {
                if contentLength > 400 {
                    return 8  // Smaller font for very long entries
                } else if contentLength > 300 {
                    return 9
                } else if contentLength > 200 {
                    return 11
                } else if contentLength > 100 {
                    return 13
                } else {
                    return 16  // Maximum font size for short entries
                }
            }()
            
            // Binary search for optimal font size
            var low: CGFloat = 6
            var high: CGFloat = baseFontSize
            var finalFontSize: CGFloat = low
            
            while low <= high {
                let mid = (low + high) / 2
                let testFont = UIFont(name: "Zain-Regular", size: mid)!
                let testAttributes: [NSAttributedString.Key: Any] = [
                    .font: testFont,
                    .kern: -0.5,
                    .paragraphStyle: contentStyle
                ]
                
                // First test if content fits beside image
                let besideImageRect = CGRect(
                    x: margin + imageWidth + margin,
                    y: contentStartY,
                    width: pageWidth - imageWidth - (margin * 3),
                    height: imageHeight
                )
                
                // Then test if remaining content fits below image
                let belowImageRect = CGRect(
                    x: margin,
                    y: contentStartY + imageHeight + margin - 4, // Reduced spacing
                    width: pageWidth - (margin * 2),
                    height: availableHeight - imageHeight - margin
                )
                
                let textToRender = NSAttributedString(string: content, attributes: testAttributes)
                let besideImageTextContainer = NSTextContainer(size: besideImageRect.size)
                let belowImageTextContainer = NSTextContainer(size: belowImageRect.size)
                let layoutManager = NSLayoutManager()
                let textStorage = NSTextStorage(attributedString: textToRender)
                
                layoutManager.addTextContainer(besideImageTextContainer)
                layoutManager.addTextContainer(belowImageTextContainer)
                textStorage.addLayoutManager(layoutManager)
                
                let glyphRange = layoutManager.glyphRange(for: belowImageTextContainer)
                let lastGlyphIndex = glyphRange.location + glyphRange.length
                
                if lastGlyphIndex >= layoutManager.numberOfGlyphs {
                    finalFontSize = mid
                    low = mid + 0.5
                } else {
                    high = mid - 0.5
                }
            }
            
            // Draw content with calculated font size
            let contentAttributes: [NSAttributedString.Key: Any] = [
                .font: UIFont(name: "Zain-Regular", size: finalFontSize)!,
                .foregroundColor: UIColor.black,
                .kern: -0.5,
                .paragraphStyle: contentStyle
            ]
            
            // Draw content beside and below image
            if mainImage != nil {
                let besideImageRect = CGRect(
                    x: margin + imageWidth + margin,
                    y: contentStartY,
                    width: pageWidth - imageWidth - (margin * 3),
                    height: imageHeight
                )
                
                content.draw(in: besideImageRect, withAttributes: contentAttributes)
                
                let belowImageRect = CGRect(
                    x: margin,
                    y: contentStartY + imageHeight + margin - 4, // Reduced spacing
                    width: pageWidth - (margin * 2),
                    height: availableHeight - imageHeight - margin
                )
                content.draw(in: belowImageRect, withAttributes: contentAttributes)
            } else {
                // If no image, use full width
                let fullContentRect = CGRect(
                    x: margin,
                    y: contentStartY,
                    width: pageWidth - (margin * 2),
                    height: availableHeight
                )
                content.draw(in: fullContentRect, withAttributes: contentAttributes)
            }
        }
    }
}
