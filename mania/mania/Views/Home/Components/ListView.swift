//
//  ListView.swift
//  mania
//
//  Created by Zain Khatri on 12/11/24.
//


// Views/Home/Components/ListView.swift
import SwiftUI

struct ListView: View {
    let entries: [JournalEntry]
    
    var body: some View {
        ScrollView {
            LazyVStack(spacing: 20) {
                ForEach(entries) { entry in
                    JournalRow(entry: entry)
                }
            }
            .padding()
        }
    }
}