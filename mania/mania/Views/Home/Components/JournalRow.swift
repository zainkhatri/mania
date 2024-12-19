//
//  JournalRow.swift
//  mania
//
//  Created by Zain Khatri on 12/11/24.
//


// Views/Home/Components/JournalRow.swift
import SwiftUI

struct JournalRow: View {
    let entry: JournalEntry
    
    var body: some View {
        HStack(spacing: 12) {
            if let firstImageURL = entry.imageURLs.first,
               let uiImage = ImageSaver.loadImage(fileName: firstImageURL.lastPathComponent) {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 80, height: 80)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(entry.title)
                    .font(.custom("Zain-Regular", size: 20))
                    .kerning(-1)
                
                Text(entry.content)
                    .font(.custom("Zain-Regular", size: 16))
                    .kerning(-0.5)
                    .foregroundColor(.gray)
                    .lineLimit(2)
                
                Text(DateFormatting.shared.formatJournalDate(entry.date))
                    .font(.custom("Zain-Regular", size: 14))
                    .kerning(-0.5)
                    .foregroundColor(.gray)
            }
            
            Spacer()
        }
        .padding()
        .background(Color.white)
        .cornerRadius(10)
        .shadow(radius: 2)
    }
}