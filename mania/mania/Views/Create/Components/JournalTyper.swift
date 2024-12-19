//  JournalTyper.swift

import SwiftUI

struct JournalTyper: View {
    @Binding var content: String
    
    var body: some View {
        TextEditor(text: $content)
            .font(.custom("Zain-Regular", size: 20))
            .kerning(-1)
            .frame(minHeight: 200)
            .overlay(
                Text("Enter journal entry...")
                    .font(.custom("Zain-Regular", size: 20))
                    .foregroundColor(Color(uiColor: .placeholderText))
                    .padding(.top, 8)
                    .padding(.leading, 4)
                    .opacity(content.isEmpty ? 1 : 0),
                alignment: .topLeading
            )
            .padding(.horizontal)
    }
}
