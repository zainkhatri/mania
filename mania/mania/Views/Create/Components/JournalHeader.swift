//  JournalHeader.swift

import SwiftUI

struct JournalHeader: View {
    @Binding var title: String
    @Binding var location: String
    @Binding var selectedDate: Date
    @State private var showingDatePicker = false
    
    private let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMMM d'th', yyyy"
        return formatter
    }()
    
    var formattedDate: String {
        dateFormatter.string(from: selectedDate).uppercased()
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            // Date Section
            HStack {
                Text(formattedDate)
                    .font(.custom("Zain-Regular", size: 32))
                    .kerning(-2.3)
                
                Spacer()
                
                Button(action: { showingDatePicker = true }) {
                    Image(systemName: "calendar")
                        .foregroundColor(.black)
                }
            }
            .sheet(isPresented: $showingDatePicker) {
                DatePicker("Select Date", selection: $selectedDate, displayedComponents: .date)
                    .datePickerStyle(.graphical)
                    .presentationDetents([.height(400)])
            }
            
            // Title & Location
            VStack(spacing: 2) {
                TextField("Enter title...", text: $title)
                    .font(.custom("Zain-Regular", size: 24))
                    .kerning(-1.5)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                
                TextField("Enter location...", text: $location)
                    .font(.custom("Zain-Regular", size: 24))
                    .kerning(-1.5)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
            }
            
            // Display combined title and location if both are entered
            if !title.isEmpty && !location.isEmpty {
                Text("\(title), \(location)")
                    .font(.custom("Zain-Regular", size: 28))
                    .kerning(-1.5)
                    .foregroundColor(.red)
            }
        }
        .padding(.horizontal)
    }
}
//  JournalHeader.swift

