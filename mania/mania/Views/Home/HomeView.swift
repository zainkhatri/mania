//
//  HomeView.swift
//  mania
//
//  Created by Zain Khatri on 12/11/24.
//


// Views/Home/HomeView.swift
import SwiftUI

struct HomeView: View {
    @State private var journalEntries: [JournalEntry] = []
    @State private var isGridView = false
    
    var body: some View {
        NavigationView {
            VStack {
                HStack {
                    Text("My Journal")
                        .font(.custom("Zain-Regular", size: 36))
                        .kerning(-2)
                    
                    Spacer()
                    
                    Button(action: { isGridView.toggle() }) {
                        Image(systemName: isGridView ? "list.bullet" : "square.grid.2x2")
                            .font(.system(size: 20))
                            .foregroundColor(.black)
                    }
                }
                .padding()
                
                if isGridView {
                    GridView(entries: journalEntries)
                } else {
                    ListView(entries: journalEntries)
                }
                
                Spacer()
            }
        }
    }
}
