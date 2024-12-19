//
//  JournalCard.swift
//  mania
//
//  Created by Zain Khatri on 12/11/24.
//


// Views/Home/Components/JournalCard.swift
import SwiftUI

struct JournalCard: View {
    let entry: JournalEntry
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let firstImageURL = entry.imageURLs.first,
               let uiImage = ImageSaver.loadImage(fileName: firstImageURL.lastPathComponent) {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
                    .frame(height: 120)
                    .clipped()
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(entry.title)
                    .font(.custom("Zain-Regular", size: 18))
                    .kerning(-1)
                    .lineLimit(1)
                
                Text(DateFormatting.shared.formatJournalDate(entry.date))
                    .font(.custom("Zain-Regular", size: 14))
                    .kerning(-0.5)
                    .foregroundColor(.gray)
            }
            .padding(.horizontal, 8)
            .padding(.bottom, 8)
        }
        .background(Color.white)
        .cornerRadius(10)
        .shadow(radius: 2)
    }
}