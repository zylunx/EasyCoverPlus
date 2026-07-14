
import struct
import sys
import os

def parse_font(file_path):
    with open(file_path, 'rb') as f:
        # Read Offset Table
        # sfnt version (4), numTables (2), searchRange (2), entrySelector (2), rangeShift (2)
        header = f.read(12)
        if len(header) < 12:
            print("Invalid font file")
            return

        sfnt_version, num_tables = struct.unpack('>I H', header[:6])
        
        fvar_offset = 0
        fvar_length = 0
        name_offset = 0
        
        # Read Table Directory
        for _ in range(num_tables):
            entry = f.read(16)
            tag, checksum, offset, length = struct.unpack('>4s I I I', entry)
            if tag == b'fvar':
                fvar_offset = offset
                fvar_length = length
            elif tag == b'name':
                name_offset = offset

        if not fvar_offset:
            print("No fvar table found (Not a variable font or unsupported format)")
            return

        # Parse fvar table
        f.seek(fvar_offset)
        # Version (4), Offset to axes (2), Count of axes (2), Size of axis record (2), Count of instances (2), Size of instance record (2)
        fvar_header = f.read(16)
        version_major, version_minor, axes_offset, reserved, axis_count, axis_size, instance_count, instance_size = struct.unpack('>H H H H H H H H', fvar_header)
        
        print(f"Variable Font Detected")
        print(f"Axis Count: {axis_count}")
        print(f"Instance Count: {instance_count}")

        # Find Weight Axis Index
        # Axes array starts at fvar_offset + axes_offset
        f.seek(fvar_offset + axes_offset)
        weight_axis_index = -1
        
        for i in range(axis_count):
            # Axis Record: Tag (4), Min (4), Default (4), Max (4), Flags (2), NameID (2)
            axis_data = f.read(axis_size)
            tag = axis_data[:4]
            if tag == b'wght':
                weight_axis_index = i
                # min_v, def_v, max_v = struct.unpack('>f f f', axis_data[4:16]) # Fixed point 16.16? No, Fixed is 16.16
                min_v, def_v, max_v = struct.unpack('>I I I', axis_data[4:16])
                print(f"Weight Axis found: Min={min_v/65536}, Max={max_v/65536}, Default={def_v/65536}")
                
        if weight_axis_index == -1:
            print("No weight axis found")
            return

        # Parse Instances
        # Instances start after axes array. 
        # Actually fvar header says: 
        # offsetToAxesArray gives offset from beginning of fvar table.
        # But where do instances start? 
        # Usually immediately after axes array. 
        # But we have `instance_count` and `instance_size`.
        # The axes array size is axis_count * axis_size.
        
        instances_start = fvar_offset + axes_offset + (axis_count * axis_size)
        f.seek(instances_start)
        
        weights = []
        
        for i in range(instance_count):
            # Instance Record: subfamilyNameID (2), flags (2), coordinates (4 * axisCount), postScriptNameID (2 - optional?)
            # coordinate is Fixed (16.16)
            
            # We need to read just enough to get the weight coordinate
            # The coordinates are an array of Fixed numbers, one for each axis.
            # We want the one at weight_axis_index.
            
            inst_data = f.read(instance_size)
            # subfamily_id = struct.unpack('>H', inst_data[:2])[0]
            
            # Coordinates start at offset 4
            coords_offset = 4
            weight_val_fixed = struct.unpack('>I', inst_data[coords_offset + weight_axis_index * 4 : coords_offset + weight_axis_index * 4 + 4])[0]
            weight_val = weight_val_fixed / 65536
            
            weights.append(int(weight_val))
            
        print(f"Detected Weights: {sorted(list(set(weights)))}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python inspect_font.py <path>")
    else:
        parse_font(sys.argv[1])
