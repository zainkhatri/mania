//
//  GridView.swift
//  mania
//
//  Created by Zain Khatri on 12/11/24.
//


// Views/Home/Components/GridView.swift
import SwiftUI

struct GridView: View {
    let entries: [JournalEntry]
    
    var body: some View {
        ScrollView {
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 20) {
                ForEach(entries) { entry in
                    JournalCard(entry: entry)
                        .frame(height: 200)
                }
            }
            .padding()
        }
    }
}