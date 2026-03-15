#extracting features 

import opensmile


def extract_acoustic_features(file_path: str) -> dict:
    smile = opensmile.Smile(
        feature_set=opensmile.FeatureSet.eGeMAPSv02,
        feature_level=opensmile.FeatureLevel.Functionals,
    )

    features_df = smile.process_file(file_path)

    return features_df.iloc[0].to_dict()